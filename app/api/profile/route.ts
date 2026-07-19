import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUserFile, saveUserFile } from "@/lib/user-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) return NextResponse.json({ error: "Name must be between 2 and 60 characters." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, image: true } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const image = form.get("image");
    const removeImage = form.get("removeImage") === "true";
    let nextImage = removeImage ? null : user.image;
    let storedImage: Awaited<ReturnType<typeof saveUserFile>> | null = null;
    if (image instanceof File && image.size > 0) {
      storedImage = await saveUserFile(image, "profiles", user.id);
      nextImage = storedImage.url;
    }

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name, image: nextImage },
        select: { name: true, image: true, email: true },
      });
      if (user.image && user.image !== updated.image) await removeUserFile(user.image);
      return NextResponse.json({ ok: true, profile: updated });
    } catch (error) {
      if (storedImage) await removeUserFile(storedImage.url);
      throw error;
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to update profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
