import { Injectable } from '@steinringer/angular-ts-decorators';

export const RIGHT_SERVICE = 'rightService';
export const UNREGISTERED_SERVICE = 'unregisteredService';

@Injectable(RIGHT_SERVICE)
export class RightService {}

export class WrongService {}
