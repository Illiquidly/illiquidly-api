import { Transform } from "class-transformer";
import { IsInt } from "class-validator";
import { Network } from "src/utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export class NotificationsQuery{
	network: Network;

  	@IsAddress()
	user: string;

	@IsInt()
	@Transform(({value}) => Number.parseInt(value))
	limit: number;

	@IsInt()
	@Transform(({value}) => Number.parseInt(value))
	offset: number;
}

export class NotificationsRead{
	network: Network;

  	@IsAddress()
	user?: string;

	notificationId?: string;
}

