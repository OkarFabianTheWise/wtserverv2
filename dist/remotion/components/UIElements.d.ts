/**
 * Remotion 2.0 UI Elements Components
 * Reusable UI elements for messages, indicators, etc.
 */
import React from 'react';
interface MessageProps {
    x: number;
    y: number;
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
    opacity?: number;
}
export declare const MessageBox: React.FC<MessageProps>;
interface LoadingSpinnerProps {
    x: number;
    y: number;
    size?: number;
    color?: string;
}
export declare const LoadingSpinner: React.FC<LoadingSpinnerProps>;
interface DataPacketProps {
    x: number;
    y: number;
    label: string;
    color?: string;
}
export declare const DataPacket: React.FC<DataPacketProps>;
/**
 * Table component for restaurant scenes
 */
interface TableProps {
    x: number;
    y: number;
    width?: number;
    height?: number;
}
export declare const Table: React.FC<TableProps>;
/**
 * Meal/Plate component for serving food
 */
interface MealProps {
    x: number;
    y: number;
    type?: 'plate' | 'tray';
}
export declare const Meal: React.FC<MealProps>;
/**
 * Order Ticket component for showing orders
 */
interface OrderTicketProps {
    x: number;
    y: number;
    itemCount?: number;
    status?: 'pending' | 'preparing' | 'ready';
}
export declare const OrderTicket: React.FC<OrderTicketProps>;
export {};
//# sourceMappingURL=UIElements.d.ts.map