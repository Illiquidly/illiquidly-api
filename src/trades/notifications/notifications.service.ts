import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Network } from '../../utils/blockchain/dto/network.dto';
import { asyncAction } from '../../utils/js/asyncAction';
import { MultipleNotificationsResponse } from '../dto/getTrades.dto';
import { getNotifications, markNotificationsRead } from '../mysql_db/access';

@Injectable()
export class NotificationsService {

	async queryNotifications(network: Network, user: string, limit: number, offset:number): Promise<MultipleNotificationsResponse> {
	  const [err, userNotifications] = await asyncAction(
	    getNotifications({
	    	network,
	    	user,
	    	limit,
	    	offset
	    })
	  );

	  if (err) {
	   throw new NotFoundException("Notifications Not Found");
	  }

	  return {
	    data: userNotifications,
	    next_offset: offset ?? 0 + userNotifications.length
	  };
	}

	async readNotifications(network: Network, user?: string, notificationId?:string) {
	  if (!notificationId && !user) {
	  	throw new BadRequestException('You must indicate a user address or a notification id');
	  }
	  let [err, _userNotifications] = await asyncAction(
	    markNotificationsRead({
	    	network,
			notificationId,
			user
	    })
	  );

	  if (err) {
	    throw new BadRequestException(err);
	  }

	  return{};
	}

}
