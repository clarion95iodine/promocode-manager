import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class CreatePromocodeDto {
  @ApiProperty({ example: 'SUMMER2024' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent!: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  totalUsageLimit?: number | null;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  perUserLimit?: number | null;

  @ApiPropertyOptional({ example: '2026-04-22T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string | null;

  @ApiPropertyOptional({ example: '2026-05-22T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string | null;
}
