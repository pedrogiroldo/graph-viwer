import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get("currentUserId");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            following: true,
            followers: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Se houver um usuário logado, verificar quem ele segue
    let followingIds: number[] = [];
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: parseInt(currentUserId) },
        select: {
          following: {
            select: { id: true },
          },
        },
      });
      followingIds = currentUser?.following.map((u) => u.id) || [];
    }

    const usersWithFollowStatus = users.map((user) => ({
      ...user,
      isFollowing: followingIds.includes(user.id),
    }));

    return NextResponse.json({ users: usersWithFollowStatus });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json(
      { users: [], error: "Erro ao buscar usuários" },
      { status: 500 }
    );
  }
}
