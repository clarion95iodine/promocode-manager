import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('formats HttpException responses', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status, json } as unknown as { status: typeof status; json: typeof json };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;

    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid payload',
      error: 'BadRequestException',
    }));
  });

  it('formats unknown errors as internal server errors', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status, json } as unknown as { status: typeof status; json: typeof json };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'boom',
      error: 'InternalServerError',
    }));
  });
});
