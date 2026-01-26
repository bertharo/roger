import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth/getSession';
import { FitnessAssessment } from '@/lib/types';
import { queryOne, query } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/fitness-assessment - Get user's fitness assessment
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    try {
      const assessment = await queryOne<{
        fitness_level: string;
        weekly_mileage: number;
        days_per_week: number;
        easy_pace_min_per_mile: number | null;
        recent_running_experience: string;
        longest_run_miles: number | null;
        completed_at: string;
      }>(
        `SELECT fitness_level, weekly_mileage, days_per_week, easy_pace_min_per_mile, 
         recent_running_experience, longest_run_miles, completed_at
         FROM fitness_assessments 
         WHERE user_id = $1 
         ORDER BY completed_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      if (assessment) {
        return NextResponse.json({
          fitnessLevel: assessment.fitness_level,
          weeklyMileage: assessment.weekly_mileage,
          daysPerWeek: assessment.days_per_week,
          easyPaceMinPerMile: assessment.easy_pace_min_per_mile,
          recentRunningExperience: assessment.recent_running_experience,
          longestRunMiles: assessment.longest_run_miles,
          completedAt: assessment.completed_at,
        });
      }
    } catch (dbError: any) {
      // If table doesn't exist, that's okay - return null
      if (dbError.message?.includes('does not exist')) {
        logger.debug('Fitness assessments table does not exist yet');
      } else {
        logger.error('Database error loading fitness assessment:', dbError);
      }
    }
    
    return NextResponse.json({ fitnessLevel: null });
  } catch (error) {
    logger.error('Error loading fitness assessment:', error);
    return NextResponse.json(
      { error: 'Failed to load fitness assessment' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fitness-assessment - Save user's fitness assessment
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const assessment: FitnessAssessment = await request.json();
    
      try {
        await query(
          `INSERT INTO fitness_assessments 
           (user_id, fitness_level, weekly_mileage, days_per_week, easy_pace_min_per_mile, 
            recent_running_experience, longest_run_miles, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             fitness_level = EXCLUDED.fitness_level,
             weekly_mileage = EXCLUDED.weekly_mileage,
             days_per_week = EXCLUDED.days_per_week,
             easy_pace_min_per_mile = EXCLUDED.easy_pace_min_per_mile,
             recent_running_experience = EXCLUDED.recent_running_experience,
             longest_run_miles = EXCLUDED.longest_run_miles,
             completed_at = EXCLUDED.completed_at,
             updated_at = NOW()`,
          [
            userId,
            assessment.fitnessLevel,
            assessment.weeklyMileage,
            assessment.daysPerWeek,
            assessment.easyPaceMinPerMile || null,
            assessment.recentRunningExperience,
            assessment.longestRunMiles || null,
            assessment.completedAt,
          ]
        );
        
        logger.info('Fitness assessment saved to database');
        return NextResponse.json({ success: true });
      } catch (dbError: any) {
        // If table doesn't exist, that's okay - we'll use localStorage
        if (dbError.message?.includes('does not exist')) {
          logger.warn('Fitness assessments table does not exist, using localStorage fallback');
          return NextResponse.json({ success: true, fallback: 'localStorage' });
        }
        logger.error('Database error saving fitness assessment:', dbError);
        return NextResponse.json(
          { error: 'Failed to save fitness assessment' },
          { status: 500 }
        );
      }
  } catch (error) {
    logger.error('Error saving fitness assessment:', error);
    return NextResponse.json(
      { error: 'Failed to save fitness assessment' },
      { status: 500 }
    );
  }
}
