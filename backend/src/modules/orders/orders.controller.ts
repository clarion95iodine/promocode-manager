import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApplyPromocodeDto } from './dto/apply-promocode.dto';
import { JwtPayload } from '../auth/auth.types';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Create an order for the current user' })
  @Post()
  create(@Req() req: Request & { user: JwtPayload }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'List current user orders' })
  @Get('me')
  findMyOrders(@Req() req: Request & { user: JwtPayload }, @Query('limit') limit?: string, @Query('skip') skip?: string) {
    return this.ordersService.findMyOrders(req.user.sub, limit ? Number(limit) : 20, skip ? Number(skip) : 0);
  }

  @ApiOperation({ summary: 'Apply a promocode to an existing order' })
  @Post(':id/apply-promocode')
  applyPromocode(@Req() req: Request & { user: JwtPayload }, @Param('id') id: string, @Body() dto: ApplyPromocodeDto) {
    return this.ordersService.applyPromocode(req.user.sub, id, dto.promocodeCode);
  }
}
