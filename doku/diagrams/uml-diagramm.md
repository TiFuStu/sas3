# UML-Klassendiagramm

```mermaid
classDiagram
  class Server {
    +start()
    +authenticate(username, password)
    +buildSessionUser(username, directoryUser, authorization)
    +sanitizeDamageCaseInput(body)
    +requireLogin(req,res,next)
    +requirePermission(permission)
    +requireAnyPermission(permissions)
  }

  class Rights {
    +resolveAuthorization(memberDns, config)
    +hasPermission(user, permission)
    +hasAnyPermission(user, permissions)
    +canViewCase(user, damageCase)
    +canEditCase(user, damageCase)
    +isOwner(user, damageCase)
  }

  class DbRepository {
    +runWithScope(scope, fn)
    +connect()
    +upsertUser(user)
    +listDamageCases(options)
    +getDamageCaseById(id)
    +createDamageCase(damageCase)
    +updateDamageCase(id, damageCase)
    +listCatalogItems(onlyActive)
    +createCatalogItem(item)
    +updateCatalogItem(id, item)
    +deleteCatalogItem(id)
    +addCatalogItemToCase(caseId, catalogId, menge)
    +getCatalogItemsForCase(caseId)
    +removeCatalogItemFromCase(posId)
    +getDbConfig(scope)
    +resetPoolsForScope(scope)
  }

  class LDAPSearch {
    +search(filter, ...attributes)
  }

  class SessionUser {
    +username : string
    +displayName : string
    +email : string
    +dienststelle : string
    +roles : string[]
    +permissions : string[]
    +isAdmin : boolean
    +isDummy : boolean
  }

  class DamageCase {
    +id : string
    +caseNumber : string
    +status : string
    +subject : string
    +createdBy : string
    +dienststelle : string
    +costsComplete : boolean
  }

  class CatalogItem {
    +id : string
    +bezeichnung : string
    +kategorie : string
    +satz : number
    +aktiv : boolean
  }

  Server --> Rights : nutzt
  Server --> DbRepository : nutzt
  Server --> LDAPSearch : nutzt
  Server --> SessionUser : erzeugt
  DbRepository --> DamageCase : mappt
  DbRepository --> CatalogItem : mappt
```