function normalizeDn(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
}

function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === undefined || value === null || value === "") {
        return [];
    }

    return [value];
}

function expandRole(roleName, roleDefinitions, visited = new Set()) {
    if (!roleName || visited.has(roleName)) {
        return [];
    }

    visited.add(roleName);
    const definition = roleDefinitions[roleName] || {};
    const inheritedRoles = asArray(definition.inherits);
    const permissions = new Set(asArray(definition.permissions));

    inheritedRoles.forEach((inheritedRole) => {
        expandRole(inheritedRole, roleDefinitions, visited).forEach((permission) => {
            permissions.add(permission);
        });
    });

    return Array.from(permissions);
}

function resolveAuthorization(memberDns, config) {
    const ldapConfig = config.ldap || {};
    const rightsConfig = config.rights || {};
    const roleDefinitions = rightsConfig.roles || {};
    const groupMappings = asArray(rightsConfig.groupMappings);
    const fallbackRoles = asArray(rightsConfig.fallbackRoles);
    const normalizedMemberDns = asArray(memberDns).map(normalizeDn);

    const matchedRoles = new Set();

    groupMappings.forEach((mapping) => {
        const mappingGroupDn = normalizeDn(mapping.groupDN);
        const mappingGroupName = normalizeDn(mapping.groupName);

        const matchesGroup = normalizedMemberDns.some((memberDn) => {
            if (mappingGroupDn && memberDn === mappingGroupDn) {
                return true;
            }

            if (mappingGroupName && memberDn.includes(`cn=${mappingGroupName}`)) {
                return true;
            }

            return false;
        });

        if (matchesGroup) {
            asArray(mapping.roles).forEach((roleName) => matchedRoles.add(roleName));
        }
    });

    const allowedGroupDn = normalizeDn(ldapConfig.allowedGroupDN);
    const allowedGroupName = normalizeDn(ldapConfig.allowedGroupName);

    const isAllowedByGroup = normalizedMemberDns.some((memberDn) => {
        if (allowedGroupDn && memberDn === allowedGroupDn) {
            return true;
        }

        if (allowedGroupName && memberDn.includes(`cn=${allowedGroupName}`)) {
            return true;
        }

        return false;
    });

    const isMember = allowedGroupDn || allowedGroupName
        ? isAllowedByGroup
        : matchedRoles.size > 0 || fallbackRoles.length > 0;

    if (isMember && matchedRoles.size === 0) {
        fallbackRoles.forEach((roleName) => matchedRoles.add(roleName));
    }

    const permissions = new Set();
    Array.from(matchedRoles).forEach((roleName) => {
        expandRole(roleName, roleDefinitions).forEach((permission) => permissions.add(permission));
    });

    const roles = Array.from(matchedRoles);
    const roleLabels = roles.map((roleName) => roleDefinitions[roleName]?.label || roleName);

    return {
        isMember,
        roles,
        roleLabels,
        permissions: Array.from(permissions).sort(),
        groups: normalizedMemberDns
    };
}

function hasPermission(user, permission) {
    return asArray(user?.permissions).includes(permission);
}

function hasAnyPermission(user, permissions) {
    return asArray(permissions).some((permission) => hasPermission(user, permission));
}

function isOwner(user, damageCase) {
    return normalizeUsername(user?.username) !== "" && normalizeUsername(user?.username) === normalizeUsername(damageCase?.createdBy);
}

function canViewCase(user, damageCase) {
    if (!damageCase) {
        return false;
    }

    if (hasPermission(user, "view_all_cases")) {
        return true;
    }

    const status = damageCase.status || "Neu";

    if (hasPermission(user, "view_leitung_cases") && (status === "Leitung" || status === "Abgeschlossen")) {
        return true;
    }

    if (hasPermission(user, "view_team_cases") && (status === "Team" || status === "Abgeschlossen")) {
        return true;
    }

    return hasPermission(user, "view_own_cases") && isOwner(user, damageCase) && status === "Neu";
}

function canEditCase(user, damageCase) {
    if (!damageCase) {
        return false;
    }

    if (hasPermission(user, "edit_all_cases")) {
        return true;
    }

    const status = damageCase.status || "Neu";

    if (hasPermission(user, "approve_case") && status === "Leitung") {
        return true;
    }

    if (hasPermission(user, "edit_team_cases") && status === "Team") {
        return true;
    }

    return hasPermission(user, "edit_own_cases") && isOwner(user, damageCase) && status === "Neu";
}

module.exports = {
    hasPermission,
    hasAnyPermission,
    canEditCase,
    canViewCase,
    isOwner,
    normalizeUsername,
    resolveAuthorization
};
