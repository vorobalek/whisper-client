import { TransmittableCallData } from './infrasctructure/transmittable-call-data';

/**
 * Interface representing data required to close a connection between peers.
 * Extends TransmittableCallData without adding additional properties.
 * Used to signal the intention to terminate a communication channel.
 */
export interface CloseCallData extends TransmittableCallData {}
