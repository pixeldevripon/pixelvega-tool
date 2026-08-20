import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { HolidaysService } from '@/leave/holidays/holidays.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCreateHolidayDocs,
  ApiDeleteHolidayDocs,
  ApiListHolidaysDocs,
  ApiUpdateHolidayDocs,
} from '@/leave/leave.swagger';
import { CreateHolidayDto, UpdateHolidayDto } from '@/leave/dto/leave.dto';

@ApiTags('Holidays')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @ApiListHolidaysDocs()
  @RequirePermissions(Permission.VIEW_HOLIDAYS)
  @Get()
  findAll() {
    return this.holidaysService.findAll();
  }

  @ApiCreateHolidayDocs()
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Post()
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: { id: string }) {
    return this.holidaysService.create(dto, user.id);
  }

  @ApiUpdateHolidayDocs()
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Patch(':holidayId')
  update(
    @Param('holidayId') id: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.holidaysService.update(id, dto, user.id);
  }

  @ApiDeleteHolidayDocs()
  @RequirePermissions(Permission.MANAGE_HOLIDAYS)
  @Delete(':holidayId')
  remove(@Param('holidayId') id: string, @CurrentUser() user: { id: string }) {
    return this.holidaysService.remove(id, user.id);
  }
}
