import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GATEWAY_CHAINS } from '../../circle/config/chains';

export async function getUser(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');
  return user;
}

export function validateGatewayChain(chain: string) {
  if (!(chain in GATEWAY_CHAINS)) {
    throw new BadRequestException(
      `Chain ${chain} does not support Gateway. Supported: ${Object.keys(GATEWAY_CHAINS).join(', ')}`,
    );
  }
}
