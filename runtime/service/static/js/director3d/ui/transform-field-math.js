(function(global){
    'use strict';

    const DEGREE = 180 / Math.PI;
    const RADIAN = Math.PI / 180;

    function number(value, fallback = 0){
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeQuaternion(value){
        const x = number(value?.[0]);
        const y = number(value?.[1]);
        const z = number(value?.[2]);
        const w = number(value?.[3], 1);
        const length = Math.hypot(x, y, z, w);
        return length > 0.000001 ? [x / length, y / length, z / length, w / length] : [0, 0, 0, 1];
    }

    function eulerDegreesFromQuaternion(value){
        const [x, y, z, w] = normalizeQuaternion(value);
        const sinX = 2 * (w * x + y * z);
        const cosX = 1 - 2 * (x * x + y * y);
        const sinY = Math.max(-1, Math.min(1, 2 * (w * y - z * x)));
        const sinZ = 2 * (w * z + x * y);
        const cosZ = 1 - 2 * (y * y + z * z);
        return [Math.atan2(sinX, cosX) * DEGREE, Math.asin(sinY) * DEGREE, Math.atan2(sinZ, cosZ) * DEGREE];
    }

    function quaternionFromEulerDegrees(value){
        const x = number(value?.[0]) * RADIAN * 0.5;
        const y = number(value?.[1]) * RADIAN * 0.5;
        const z = number(value?.[2]) * RADIAN * 0.5;
        const cx = Math.cos(x), sx = Math.sin(x);
        const cy = Math.cos(y), sy = Math.sin(y);
        const cz = Math.cos(z), sz = Math.sin(z);
        return normalizeQuaternion([
            sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz
        ]);
    }

    global.Director3DTransformFieldMath = Object.freeze({
        normalizeQuaternion,
        eulerDegreesFromQuaternion,
        quaternionFromEulerDegrees
    });
})(window);
