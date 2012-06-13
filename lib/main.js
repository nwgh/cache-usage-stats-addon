/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/
 */

var { Cc, Ci, Cu, Cr, Cm } = require("chrome");
var obsSvc = require("observer-service");
var xhr = require("xhr");

if (org === undefined) {
    var org = {};
}

if (org.todesschaf === undefined) {
    org.todesschaf = {};
}

org.todesschaf.cacheUsage = {};

org.todesschaf.cacheUsage.startupCacheInfo = {};
org.todesschaf.cacheUsage.shutdownCacheInfo = {};

org.todesschaf.cacheUsage.collectData = function(storage) {
    storage.items = {};

    var Visitor = function() {};

    Visitor.prototype = {
        QueryInterface: function(iid) {
            if (iid.equals(Ci.nsISupports) ||
                iid.equals(Ci.nsICacheVisitor))
                return this;
            throw Cr.NS_ERROR_NO_INTERFACE;
        },

        visitDevice: function (deviceID, deviceInfo) {
            if (deviceID != "disk") {
                // Don't care about visiting entries on non-disk devices
                return false;
            }

            storage.entryCount = deviceInfo.entryCount;
            storage.totalSize = deviceInfo.totalSize;

            return storage.entryCount > 0;
        },

        visitEntry: function (deviceID, entryInfo) {
            if (deviceID != "disk") {
                // This shouldn't have happened...
                return false;
            }

            storage.items[entryInfo.key] = {"fetchCount": entryInfo.fetchCount,
                                            "dataSize": entryInfo.dataSize};

            return true;
        }
    };

    var cacheSvc = Cc["@mozilla.org/network/cache-service;1"].
        getService(Ci.nsICacheService);
    cacheSvc.visitEntries(new Visitor());
}

org.todesschaf.cacheUsage.onProfileDisappearing = function(subject, data) {
    // Go through the cache again and find out what we're ending with
    this.collectData(this.shutdownCacheInfo);

    // Now calculate our data to be written
    var now = new Date();
    var cacheUsageData = {};
    cacheUsageData.evictedCount = 0;
    cacheUsageData.evictedBytes = 0;
    cacheUsageData.usedCount = 0;
    cacheUsageData.usedBytes = 0;
    cacheUsageData.unusedCount = 0;
    cacheUsageData.unusedBytes = 0;
    cacheUsageData.newCount = 0;
    cacheUsageData.newBytes = 0;
    cacheUsageData.startupTime = this.startupTime;
    cacheUsageData.shutdownTime = now.getTime();
    cacheUsageData.startupCount = this.startupCacheInfo.entryCount;
    cacheUsageData.shutdownCount = this.shutdownCacheInfo.entryCount;
    cacheUsageData.startupSize = this.startupCacheInfo.totalSize;
    cacheUsageData.shutdownSize = this.shutdownCacheInfo.totalSize;

    for (k in this.startupCacheInfo.items) {
        if (this.shutdownCacheInfo.items.hasOwnProperty(k)) {
            if (this.shutdownCacheInfo.items[k].fetchCount !=
                this.startupCacheInfo.items[k].fetchCount) {
                // We used this item at least once, since its fetch count changed
                cacheUsageData.usedCount++;
                cacheUsageData.usedBytes += this.startupCacheInfo.items[k].dataSize;
            } else {
                // This item went unused during this session. So sad.
                cacheUsageData.unusedCount++;
                cacheUsageData.unusedBytes += this.startupCacheInfo.items[k].dataSize;
            }
        } else {
            // This one went byebye
            cacheUsageData.evictedCount++;
            cacheUsageData.evictedBytes += this.startupCacheInfo.items[k].dataSize;
        }
    }

    for (k in this.shutdownCacheInfo.items) {
        if (!this.startupCacheInfo.items.hasOwnProperty(k)) {
            cacheUsageData.newCount++;
            cacheUsageData.newBytes += this.shutdownCacheInfo.items[k].dataSize;
        }
    }

    // Finally, send our stuff over the wire
    var req = new xhr.XMLHttpRequest();
    req.open('POST', 'http://severe-window-9421.herokuapp.com/report', false);
    req.send(JSON.stringify(cacheUsageData));
};

org.todesschaf.cacheUsage.setup = function() {
    // Go through the cache and find out what we're starting with
    this.collectData(this.startupCacheInfo);

    // Finally, listen for the cache going away, so we can do our final data
    // collection when that happens
    obsSvc.add("quit-application-granted", this.onProfileDisappearing, this);
};

org.todesschaf.cacheUsage.setup();
