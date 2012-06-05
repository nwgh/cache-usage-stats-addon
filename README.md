This is a firefox add-on to collect information about how the disk cache is used
over a single browsing session. It is designed to collect the following
information:

* How many entries were used that were already in the cache (and how many bytes
  those entries accounted for)
* How many entries were created in the cache (and how many bytes those entries
  accounted for)
* How many entries were removed from the cache (and how many bytes those entries
  accounted for)
* How many entries (and bytes) were in the cache at startup
* How many entries (and bytes) were in the cache at shutdown

No identifiable information is ever persisted to disk, this just saves entry
counts and byte counts in a json file. The results of the session are stored
in:

FIREFOXPROFILE/org.todesschaf.mozilla.cacheUsage/YYYY\_MM\_DD\_hh\_mm\_ss.json
A shortcut to your FIREFOXPROFILE is located on the about:support page.

This extension *will* make your startup and shutdown times slower, no doubt
about it. How bad it makes things depends on the size of your disk cache. It
shouldn't affect performance during normal browsing, though.
