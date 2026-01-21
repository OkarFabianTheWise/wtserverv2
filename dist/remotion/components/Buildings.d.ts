/**
 * Remotion 2.0 Building Components
 * Reusable building/location components
 */
import React from 'react';
interface BuildingProps {
    x: number;
    y: number;
    status?: 'open' | 'closed' | 'busy';
    label?: string;
}
export declare const Restaurant: React.FC<BuildingProps>;
export declare const Bakery: React.FC<BuildingProps>;
export declare const Library: React.FC<BuildingProps>;
export declare const Factory: React.FC<BuildingProps>;
export {};
//# sourceMappingURL=Buildings.d.ts.map