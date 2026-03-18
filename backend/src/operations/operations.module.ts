import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { SendService } from './send.service';
import { CollectService } from './collect.service';
import { SwapDepositService } from './swap-deposit.service';
import { MintWorkerService } from './mint-worker.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [OperationsService, SendService, CollectService, SwapDepositService, MintWorkerService],
})
export class OperationsModule {}
