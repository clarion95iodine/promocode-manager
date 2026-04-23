import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ description: 'Returns auth tokens and the created user' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ description: 'Returns auth tokens and the authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const rateLimitKey = `rate:login:${req.ip ?? 'unknown'}:${dto.email.toLowerCase()}`;
    return this.authService.login(dto, rateLimitKey);
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ description: 'Returns a fresh access and refresh token pair' })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const payload = await this.authService.decodeRefreshToken(dto.refreshToken);
    return this.authService.refresh(payload.sub, dto.refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: JwtPayload }) {
    return this.authService.verifyAccessPayload(req.user);
  }
}
