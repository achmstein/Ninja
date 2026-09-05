package com.chillax.pos

import android.app.admin.DeviceAdminReceiver

/**
 * The device-admin component `dpm set-device-owner` points at. Nothing to
 * do on its callbacks: owner rights are only used to pin the app.
 */
class PosDeviceAdminReceiver : DeviceAdminReceiver()
