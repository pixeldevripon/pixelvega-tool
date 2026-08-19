import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from '@/leave/dto/create-holiday.dto';
import { UpdateHolidayDto } from '@/leave/dto/update-holiday.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Holidays')
@ApiCookieAuth('better-auth.session_token')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @ApiOperation({ summary: 'List all company holidays' })
  @ApiResponse({ status: 200, description: 'Holidays' })
  @Get()
  findAll() {
    return this.holidaysService.findAll();
  }

  @ApiOperation({ summary: 'Create a company holiday. ADMIN only.' })
  @ApiResponse({ status: 201, description: 'Holiday created' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Post()
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: { id: string }) {
    return this.holidaysService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Update a company holiday. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Holiday updated' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.holidaysService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Delete a company holiday. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Holiday deleted' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.holidaysService.remove(id, user.id);
  }
}
