import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletDiagnosticController } from './wallet-diagnostic.controller';
import { WalletService } from './wallet.service';
import { UserOpCacheService } from './userop-cache.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WalletController, WalletDiagnosticController],
  providers: [WalletService, UserOpCacheService],
})
export class WalletModule {}
