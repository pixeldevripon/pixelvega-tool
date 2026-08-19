import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';

@Module({
  controllers: [
    LeaveRequestsController,
    LeaveTypesController,
    HolidaysController,
  ],
  providers: [
    LeaveRequestsService,
    LeaveBalancesService,
    LeaveTypesService,
    HolidaysService,
  ],
})
export class LeaveModule {}
