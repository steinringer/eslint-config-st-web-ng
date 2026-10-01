import { InstantNotification as Notification } from './Core/services/instant-notification.service';

export function examples(notification: Notification, promise: Promise<void>) {
    promise.catch(error => notification.processFailure(error));
    promise.catch(error => { return notification.processFailure(error); });
    promise.catch(error => { notification.processFailure(error); });

    promise.catch(notification.processFailure);
    promise.catch(error => { console.log(error); notification.processFailure(error); });
    promise.catch(error => notification.processFailure(error.message));
    promise.catch(async error => notification.processFailure(error));
    promise.catch(error => { notification.processFailure(error); throw error; });
}

class OtherNotification {
    processFailure(error: unknown) { console.log(this, error); }
}

export function unrelated(notification: OtherNotification, promise: Promise<void>) {
    promise.catch(error => notification.processFailure(error));
}

class CatchLookalike {
    catch(callback: (error: unknown) => void) { callback('synthetic'); }
}

export function nonPromises(notification: Notification, custom: CatchLookalike, unknownReceiver: any) {
    custom.catch(error => notification.processFailure(error));
    unknownReceiver.catch(error => notification.processFailure(error));
}
