import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { emitSocketEvent } from "@/lib/socket";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Username, senha e nome são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o username já existe
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username já está em uso" },
        { status: 400 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name: name.trim(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
      },
    });

    // Emitir evento Socket.io para atualizar lista de usuários
    emitSocketEvent("users-updated");

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}
