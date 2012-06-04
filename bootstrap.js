/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/
 */
"use strict";

const {
    classes: Cc,
    interfaces: Ci,
    utils: Cu,
    Constructor: ctor
} = Components;
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Services = Object.create(Services);
XPCOMUtils.defineLazyServiceGetter(Services,
                                   "cache",
                                   "@mozilla.org/network/cache-service;1",
                                   "nsICacheService"
                                   );

const OutputStream = ctor("@mozilla.org/intl/converter-output-stream;1",
                          "nsIConverterOutputStream", "init");

function pad2(s) {
    s = s.toString();
    return s.length < 2 ? "0" + s : s;
}

function getFileName() {
    const now = new Date();
    const yy = now.getUTCFullYear();
    const mo = now.getUTCMonth() + 1;
    const dd = now.getUTCDate();
    const hh = now.getUTCHours();
    const mm = now.getUTCMinutes();
    const ss = now.getUTCSeconds();
    return [yy, mo, dd, hh, mm, ss].map(function(e) pad2(e)).join("-") + ".json";
}

function collectData() {
    const data = Object.create(null);
    const items = Object.create(null);
    const visitor = {
        QueryInterface: XPCOMUtils.generateQI([Ci.nsICacheVisitor]),
        visitDevice: function(deviceID, deviceInfo) {
            if (deviceID != "disk") {
                return false;
            }

            data.time = new Date().getTime();
            data.entryCount = deviceInfo.entryCount;
            data.totalSize = deviceInfo.totalSize;

            return data.entryCount > 0;
        },
        visitEntry: function(deviceID, entryInfo) {
            if (deviceID != "disk") {
                // This shouldn't have happened...
                return false;
            }

            items[entryInfo.key] = {
                "fetchCount": entryInfo.fetchCount,
                "dataSize": entryInfo.dataSize
            };

            return true;
        }
    };
    Services.cache.visitEntries(visitor);
    data.items = items;
    return data;
}


var startupInfo;

function startup() {
    startupInfo = collectData();
}

function shutdown() {
    // Go through the cache again and find out what we're ending with
    const shutdownInfo = collectData();

    // Now calculate our data to be written
    const data = {
        evictedCount: 0,
        evictedBytes: 0,
        usedCount: 0,
        usedBytes: 0,
        unusedCount: 0,
        unusedBytes: 0,
        newCount: 0,
        newBytes: 0,
        startupTime: startupInfo.time,
        shutdownTime: shutdownInfo.time,
        startupCount: startupInfo.entryCount,
        shutdownCount: shutdownInfo.entryCount,
        startupSize: startupInfo.totalSize,
        shutdownSize: shutdownInfo.totalSize
    };

    for (let [k, item] in Iterator(startupInfo.items)) {
        if (!(k in shutdownInfo.items)) {
            data.evictedCount++;
            data.evictedBytes += item.dataSize;
            continue;
        }

        if (item.fetchCount != shutdownInfo.items[k].fetchCount) {
            data.usedCount++;
            data.usedBytes += item.dataSize;
            continue;
        }

        data.unusedCount++;
        data.unusedBytes += item.dataSize;
    }
    for (let [k, item] in Iterator(shutdownInfo.items)) {
        if (k in startupInfo.items) {
            continue;
        }

        data.newCount++;
        data.newBytes += item.dataSize;
    }

    // ... and save the collected information
    const file = FileUtils.getFile("ProfD",
                                   ["org.todesschaf.mozilla.cacheUsage",
                                    getFileName()]);
    const ostream = new OutputStream(FileUtils.openFileOutputStream(file),
                                     "UTF-8",
                                     4096,
                                     0xFFFD);
    ostream.writeString(JSON.stringify(data));
    ostream.flush();
    ostream.close();
}

function install() {}
function uninstall() {}

/* vim: set et ts=4 sw=4 : */
