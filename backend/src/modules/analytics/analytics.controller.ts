import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'Get users analytics table' })
  @Get('users')
  users(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.users(query);
  }

  @ApiOperation({ summary: 'Get promocodes analytics table' })
  @Get('promocodes')
  promocodes(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.promocodes(query);
  }

  @ApiOperation({ summary: 'Get promo usages analytics table' })
  @Get('promo-usages')
  promoUsages(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.promoUsages(query);
  }
}
