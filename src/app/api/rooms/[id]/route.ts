import { NextResponse } from 'next/server';
import { db } from '@/configs/db';
import { classroomsTable, membershipsTable } from '@/configs/schema';
import { eq, and } from 'drizzle-orm';
import { checkUserBlock } from '@/lib/auth-utils';
import { buildErrorResponse } from '@/lib/error-handler';
import {
    parseClassroomId,
    requireAuth,
    requireTeacher,
} from '@/lib/auth/membership-guard';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { email } = await requireAuth();

        // 0. Check if user is blocked
        const { isBlocked, errorResponse } = await checkUserBlock(email);
        if (isBlocked) return errorResponse;
        const { id } = await params;
        const roomId = parseClassroomId(id);

        // Optimised query: Fetch classroom and membership in a single join
        const [roomData] = await db
            .select({
                id: classroomsTable.id,
                name: classroomsTable.name,
                university: classroomsTable.university,
                year: classroomsTable.year,
                teacherEmail: classroomsTable.teacherEmail,
                inviteCode: classroomsTable.inviteCode,
                pedagogyLevel: classroomsTable.pedagogyLevel,
                targetGradeLevel: classroomsTable.targetGradeLevel,
                role: membershipsTable.role,
            })
            .from(classroomsTable)
            .innerJoin(
                membershipsTable,
                and(eq(membershipsTable.classroomId, classroomsTable.id), eq(membershipsTable.userEmail, email))
            )
            .where(eq(classroomsTable.id, roomId));

        if (!roomData) {
            return NextResponse.json({ error: 'Room not found or access denied' }, { status: 404 });
        }

        return NextResponse.json(roomData);
    } catch (error) {
        const { status, body } = buildErrorResponse(error);
        return NextResponse.json(body, { status });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { email } = await requireAuth();

        // 0. Check if user is blocked
        const { isBlocked, errorResponse } = await checkUserBlock(email);
        if (isBlocked) return errorResponse;

        const { id } = await params;
        const roomId = parseClassroomId(id);
        await requireTeacher(email, roomId);

        const { pedagogyLevel, targetGradeLevel } = await req.json();

        if (pedagogyLevel === undefined || targetGradeLevel === undefined) {
            return NextResponse.json({ error: 'pedagogyLevel and targetGradeLevel are required' }, { status: 400 });
        }

        const [updatedRoom] = await db
            .update(classroomsTable)
            .set({
                pedagogyLevel,
                targetGradeLevel: parseInt(targetGradeLevel.toString()),
            })
            .where(eq(classroomsTable.id, roomId))
            .returning();

        return NextResponse.json(updatedRoom);
    } catch (error) {
        const { status, body } = buildErrorResponse(error);
        return NextResponse.json(body, { status });
    }
}
