import { Module } from '@nestjs/common';
import { LeaveRequestsController } from '@/leave/requests/leave-requests.controller';
import { LeaveRequestsService } from '@/leave/requests/leave-requests.service';
import { LeaveBalancesService } from '@/leave/requests/leave-balances.service';
import { LeaveTypesController } from '@/leave/types/leave-types.controller';
import { LeaveTypesService } from '@/leave/types/leave-types.service';
import { HolidaysController } from '@/leave/holidays/holidays.controller';
import { HolidaysService } from '@/leave/holidays/holidays.service';

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
