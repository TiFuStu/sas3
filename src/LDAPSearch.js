"use strict";

const child_process = require("node:child_process");
const fs = require("node:fs");

function LDAP_STRING_TYPE(buffer) {
  return buffer instanceof Buffer ? buffer.toString("utf8") : buffer;
}
function LDAP_GUID_TYPE(buffer) {
  const guidParts = [Buffer.alloc(4), Buffer.alloc(2), Buffer.alloc(2)];
  guidParts[0].writeUInt32BE(buffer.readUInt32LE(0));
  guidParts[1].writeUInt16BE(buffer.readUInt16LE(4));
  guidParts[2].writeUInt16BE(buffer.readUInt16LE(6));
  guidParts.push(buffer.subarray(8, 10));
  guidParts.push(buffer.subarray(10, 16));

  return (
    "{" +
    guidParts
      .map((b) => {
        return b.toString("hex").toUpperCase();
      })
      .join("-") +
    "}"
  );
}

function LDAP_DATE_TYPE(buffer) {
  return new Date(
    Number((BigInt(LDAP_STRING_TYPE(buffer)) - 116444736000000000n) / 10000n),
  );
}

function LDAP_BINARY_TYPE(buffer) {
  return buffer;
}

const LDAP_ATTRIBUTE_TYPES = {
  objectGUID: LDAP_GUID_TYPE,
  thumbnailPhoto: LDAP_BINARY_TYPE,
  objectSid: LDAP_BINARY_TYPE,
  userCertificate: LDAP_BINARY_TYPE,
  pwdLastSet: LDAP_DATE_TYPE,
  badPasswordTime: LDAP_DATE_TYPE,

  lastLogonTimestamp: LDAP_DATE_TYPE,
  lastLogon: LDAP_DATE_TYPE,
};

class LDAPSearch {
  constructor(realm, username, password) {
    this.credentials = { realm, username, password };
    const cache = {};
    const internalSearch = (baseDN, scope, filter, ...attributes) => {
      const key = JSON.stringify([baseDN, scope, filter, ...attributes]);
      if (!(key in cache)) {
        cache[key] = Promise.all([
          fs.promises
            .readFile("/etc/lbm/hosts/PRIMARY_DC", "utf8")
            .catch(() => "10.193.2.2"),
          fs.promises
            .readFile("/etc/lbm/hosts/SECONDARY_DC", "utf8")
            .catch(() => "10.193.2.2"),
        ]).then(([primaryDC, secondaryDC]) => {
          return new Promise((resolve, reject) => {
            const hostArg = `ldap://${primaryDC.trim()} ldap://${secondaryDC.trim()}`;
            const childProcess = child_process.spawn("/usr/bin/ldapsearch", [
              "-H",
              hostArg,
              "-D",
              this.credentials.realm + "\\" + this.credentials.username,
              "-w",
              this.credentials.password,
              "-b",
              baseDN,
              "-s",
              scope,
              "-LLL",
              filter,
              ...attributes,
            ]);

            const chunks = [];
            const errorChunks = [];

            childProcess.stdin.end();
            childProcess.stderr.on("data", (buf) => {
              errorChunks.push(buf);
            });
            childProcess.stdout.on("data", (chunk) => chunks.push(chunk));

            const ldifPat = /(\w+)(\:*) ([^\n]|\n )*|(\n\n)/g;
            childProcess.on("error", reject);

            childProcess.on("close", (code, signal) => {
              if (code === 32) {
                resolve([]);
              } else if (code !== 0) {
                const stderrOutput = Buffer.concat(errorChunks)
                  .toString("utf8")
                  .trim();
                return reject(
                  `ldapsearch returned statuscode ${code}${
                    stderrOutput ? `: ${stderrOutput}` : ""
                  }`,
                );
              }

              const ldif = Buffer.concat(chunks).toString("utf8");

              let ldifEntry = null;
              const resultset = [];
              let entry = {};
              let valCount = 0;
              while ((ldifEntry = ldifPat.exec(ldif)) !== null) {
                if (ldifEntry[0] === "\n\n") {
                  if (valCount > 0) {
                    resultset.push(entry);
                    entry = {};
                    valCount = 0;
                  }
                } else {
                  valCount++;
                  const key = ldifEntry[1];
                  const rawVal = ldifEntry[0]
                    .substr(key.length + 2, ldifEntry[0].length)
                    .replace(/\n /g, "");
                  const val =
                    ldifEntry[2] === "::"
                      ? Buffer.from(rawVal, "base64")
                      : rawVal;
                  const convert =
                    key in LDAP_ATTRIBUTE_TYPES
                      ? LDAP_ATTRIBUTE_TYPES[key]
                      : LDAP_STRING_TYPE;
                  if (key in entry) {
                    entry[key].push(convert(val));
                  } else {
                    entry[key] = [convert(val)];
                  }
                }
              }
              if (valCount > 0) {
                resultset.push(entry);
              }
              resolve(resultset);
            });
          });
        });
      }
      return cache[key];
    };
    this.search = (...args) =>
      internalSearch("DC=lsv,DC=intra", "sub", ...args);
    this.lookup = (dn, ...args) =>
      internalSearch(dn, "base", "(objectClass=*)", ...args);
  }
}

module.exports = LDAPSearch;
