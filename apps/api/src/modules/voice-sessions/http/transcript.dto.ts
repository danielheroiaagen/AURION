import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString, Length, Min, ValidateNested } from 'class-validator';

import type { TurnSpeaker } from '../../../database/database.schema';
import type { ConversationTurnRecord } from '../application/transcript.repository.port';

const TURN_SPEAKERS: readonly TurnSpeaker[] = ['caller', 'agent'];

export class TranscriptTurnDto {
  @ApiProperty({ minimum: 0, description: 'Zero-based position of the turn in the conversation.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @ApiProperty({ enum: TURN_SPEAKERS })
  @IsIn(TURN_SPEAKERS)
  speaker!: TurnSpeaker;

  @ApiProperty({ maxLength: 8000, description: 'What was said on this turn. Encrypted at rest.' })
  @IsString()
  @Length(1, 8000)
  text!: string;
}

export class AppendTranscriptDto {
  @ApiProperty({ type: [TranscriptTurnDto], description: 'Turns to append (idempotent on index).' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TranscriptTurnDto)
  turns!: TranscriptTurnDto[];
}

export interface AppendTranscriptResponse {
  /** Number of NEW turns persisted (idempotent replays count as 0). */
  persisted: number;
}

export interface TranscriptTurnResponse {
  index: number;
  speaker: TurnSpeaker;
  text: string;
  created_at: string;
}

export interface TranscriptResponse {
  items: TranscriptTurnResponse[];
}

export function toTranscriptResponse(records: ConversationTurnRecord[]): TranscriptResponse {
  return {
    items: records.map((record) => ({
      index: record.turnIndex,
      speaker: record.speaker,
      text: record.text,
      created_at: record.createdAt.toISOString(),
    })),
  };
}
