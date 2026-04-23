import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromocodesService } from './promocodes.service';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
import { UpdatePromocodeDto } from './dto/update-promocode.dto';

@ApiTags('Promocodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promocodes')
export class PromocodesController {
  constructor(private readonly promocodesService: PromocodesService) {}

  @ApiOperation({ summary: 'Create a promocode' })
  @Post()
  create(@Body() dto: CreatePromocodeDto) {
    return this.promocodesService.create(dto);
  }

  @ApiOperation({ summary: 'List promocodes' })
  @Get()
  findAll(@Query('limit') limit?: string, @Query('skip') skip?: string) {
    return this.promocodesService.findAll(limit ? Number(limit) : 20, skip ? Number(skip) : 0);
  }

  @ApiOperation({ summary: 'Get promocode by id' })
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.promocodesService.findById(id);
  }

  @ApiOperation({ summary: 'Update a promocode' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromocodeDto) {
    return this.promocodesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a promocode' })
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.promocodesService.deactivate(id);
  }
}
