import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCurrentFrame } from 'remotion';
// Restaurant/Kitchen (for API/Server analogies)
export const Restaurant = ({ x, y, status = 'open', label = '🍽️ API' }) => {
    const statusColors = {
        open: '#10B981',
        closed: '#EF4444',
        busy: '#F59E0B'
    };
    return (_jsx("div", { style: { position: 'absolute', left: x, top: y }, children: _jsxs("div", { style: {
                width: 140,
                height: 160,
                backgroundColor: '#DC2626',
                borderRadius: '8px 8px 0 0',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }, children: [_jsx("div", { style: {
                        position: 'absolute',
                        top: 60,
                        left: 0,
                        width: 140,
                        height: 30,
                        backgroundColor: '#7C2D12',
                        borderRadius: '5px',
                    }, children: [...Array(7)].map((_, i) => (_jsx("div", { style: {
                            position: 'absolute',
                            bottom: -15,
                            left: i * 20,
                            width: 0,
                            height: 0,
                            borderLeft: '10px solid transparent',
                            borderRight: '10px solid transparent',
                            borderTop: '15px solid #7C2D12',
                        } }, i))) }), _jsx("div", { style: {
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        width: 100,
                        height: 30,
                        backgroundColor: statusColors[status],
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 14,
                    }, children: label }), _jsx("div", { style: {
                        position: 'absolute',
                        bottom: 0,
                        left: 45,
                        width: 50,
                        height: 70,
                        backgroundColor: status === 'open' ? '#10B981' : '#6B7280',
                        borderRadius: '8px 8px 0 0',
                    } }), _jsx("div", { style: {
                        position: 'absolute',
                        bottom: 100,
                        right: 10,
                        padding: '4px 8px',
                        backgroundColor: statusColors[status],
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 'bold',
                    }, children: status.toUpperCase() })] }) }));
};
// Bakery/Shop (for boolean returns, simple services)
export const Bakery = ({ x, y, status = 'open', label = '🥖 BAKERY' }) => {
    return (_jsx("div", { style: { position: 'absolute', left: x, top: y }, children: _jsxs("div", { style: {
                width: 120,
                height: 150,
                backgroundColor: '#8B4513',
                borderRadius: '8px 8px 0 0',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }, children: [_jsx("div", { style: {
                        position: 'absolute',
                        top: -30,
                        left: -10,
                        width: 0,
                        height: 0,
                        borderLeft: '70px solid transparent',
                        borderRight: '70px solid transparent',
                        borderBottom: '30px solid #F59E0B',
                    } }), _jsx("div", { style: {
                        position: 'absolute',
                        top: 20,
                        left: 10,
                        width: 100,
                        height: 30,
                        backgroundColor: '#10B981',
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 14,
                    }, children: label }), _jsx("div", { style: {
                        position: 'absolute',
                        bottom: 0,
                        left: 35,
                        width: 50,
                        height: 70,
                        backgroundColor: status === 'open' ? '#10B981' : '#555',
                        borderRadius: '8px 8px 0 0',
                    } }), _jsx("div", { style: {
                        position: 'absolute',
                        bottom: 80,
                        right: 10,
                        padding: '4px 8px',
                        backgroundColor: status === 'open' ? '#10B981' : '#EF4444',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 'bold',
                    }, children: status === 'open' ? 'OPEN' : 'CLOSED' })] }) }));
};
// Library/Database (for storage/data analogies)
export const Library = ({ x, y, status = 'open', label = '📚 DATABASE' }) => {
    return (_jsx("div", { style: { position: 'absolute', left: x, top: y }, children: _jsxs("div", { style: {
                width: 150,
                height: 180,
                backgroundColor: '#1E3A8A',
                borderRadius: '10px 10px 0 0',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }, children: [[20, 50, 80, 110].map((left, i) => (_jsx("div", { style: {
                        position: 'absolute',
                        bottom: 0,
                        left,
                        width: 20,
                        height: 140,
                        backgroundColor: '#F3F4F6',
                        borderRadius: '5px 5px 0 0',
                    } }, i))), _jsx("div", { style: {
                        position: 'absolute',
                        top: 15,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '8px 16px',
                        backgroundColor: '#059669',
                        color: 'white',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 'bold',
                        zIndex: 10,
                    }, children: label })] }) }));
};
// Factory/Pipeline (for build systems, data processing)
export const Factory = ({ x, y, status = 'open', label = '🏭 PIPELINE' }) => {
    const frame = useCurrentFrame();
    const smoke = Math.sin(frame / 10) * 2;
    return (_jsxs("div", { style: { position: 'absolute', left: x, top: y }, children: [_jsx("div", { style: {
                    position: 'absolute',
                    top: -60,
                    left: 80,
                    width: 25,
                    height: 60,
                    backgroundColor: '#374151',
                    borderRadius: '5px 5px 0 0',
                }, children: _jsx("div", { style: {
                        position: 'absolute',
                        top: -20 + smoke,
                        left: 5,
                        width: 15,
                        height: 15,
                        backgroundColor: 'rgba(156, 163, 175, 0.6)',
                        borderRadius: '50%',
                    } }) }), _jsxs("div", { style: {
                    width: 160,
                    height: 140,
                    backgroundColor: '#6B7280',
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }, children: [[20, 60, 100].map((left, i) => (_jsx("div", { style: {
                            position: 'absolute',
                            top: 30,
                            left,
                            width: 30,
                            height: 40,
                            backgroundColor: status === 'open' ? '#FCD34D' : '#374151',
                            borderRadius: 3,
                        } }, i))), _jsx("div", { style: {
                            position: 'absolute',
                            bottom: 90,
                            left: 10,
                            padding: '6px 12px',
                            backgroundColor: '#F59E0B',
                            color: 'white',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 'bold',
                        }, children: label }), _jsx("div", { style: {
                            position: 'absolute',
                            bottom: 0,
                            right: 20,
                            width: 60,
                            height: 50,
                            backgroundColor: '#374151',
                            borderRadius: '5px 5px 0 0',
                        } })] })] }));
};
//# sourceMappingURL=Buildings.js.map