<?php

namespace App\Support;

class ByteFormatter
{
    public static function human(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $value = (float) $bytes;

        foreach ($units as $unit) {
            if ($value < 1024 || $unit === 'TB') {
                return round($value, $unit === 'B' ? 0 : 2).' '.$unit;
            }

            $value /= 1024;
        }

        return $bytes.' B';
    }

    public static function gbToBytes(float $gb): int
    {
        return (int) round($gb * 1024 * 1024 * 1024);
    }

    public static function bytesToGb(int $bytes): float
    {
        return round($bytes / 1024 / 1024 / 1024, 2);
    }
}
