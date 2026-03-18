import { Global, Module } from '@nestjs/common';
import { CircleService } from './circle.service';
import { GatewayService } from './gateway/gateway.service';
import { RpcService } from './rpc.service';
import { UserOpService } from './userop.service';

@Global()
@Module({
  providers: [CircleService, GatewayService, RpcService, UserOpService],
  exports: [CircleService, GatewayService, RpcService, UserOpService],
})
export class CircleModule {}
