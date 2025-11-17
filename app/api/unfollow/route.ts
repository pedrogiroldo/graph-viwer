import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emitSocketEvent } from "@/lib/socket";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { followerId, followingId } = body;

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: "followerId e followingId são obrigatórios" },
        { status: 400 }
      );
    }

    const followerIdNum = parseInt(followerId);
    const followingIdNum = parseInt(followingId);

    if (isNaN(followerIdNum) || isNaN(followingIdNum)) {
      return NextResponse.json(
        { error: "IDs inválidos" },
        { status: 400 }
      );
    }

    // Impedir unfollow para si mesmo
    if (followerIdNum === followingIdNum) {
      return NextResponse.json(
        { error: "Não é possível deixar de seguir a si mesmo" },
        { status: 400 }
      );
    }

    // Verificar se os usuários existem
    const [follower, following] = await Promise.all([
      prisma.user.findUnique({ where: { id: followerIdNum } }),
      prisma.user.findUnique({ where: { id: followingIdNum } }),
    ]);

    if (!follower || !following) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se segue
    const isFollowing = await prisma.user.findFirst({
      where: {
        id: followerIdNum,
        following: {
          some: {
            id: followingIdNum,
          },
        },
      },
    });

    if (!isFollowing) {
      return NextResponse.json(
        { error: "Você não segue este usuário" },
        { status: 400 }
      );
    }

    // Remover relação de follow e criar post
    await prisma.$transaction([
      prisma.user.update({
        where: { id: followerIdNum },
        data: {
          following: {
            disconnect: { id: followingIdNum },
          },
        },
      }),
      prisma.post.create({
        data: {
          followerId: followerIdNum,
          followingId: followingIdNum,
          action: "unfollow",
        },
      }),
    ]);

    // Emitir eventos Socket.io
    emitSocketEvent("graph-updated");
    emitSocketEvent("posts-updated");
    emitSocketEvent("users-updated");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao remover follow:", error);
    return NextResponse.json(
      { error: "Erro ao remover follow" },
      { status: 500 }
    );
  }
}
