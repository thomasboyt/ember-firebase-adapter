export var Serializer = DS.JSONSerializer.extend({

  // thanks @rpflorence's localStorage adapter 
  extract: function(loader, json, type, record) {
    this._super(loader, this.rootJSON(json, type), type, record);
  },
  
  extractMany: function(loader, json, type, records) {
    this._super(loader, this.rootJSON(json, type, 'pluralize'), type, records);    
  },

  rootJSON: function(json, type, pluralize) {
    var root = this.rootForType(type);
    if (pluralize == 'pluralize') { root = this.pluralize(root); }
    var rootedJSON = {};
    rootedJSON[root] = json;
    return rootedJSON;
  },

  rootForType: function(type) {
    var map = this.mappings.get(type)
    if (map && map.resourceName) return map.resourceName;

    return this._super(type);
  },

  extractHasMany: function(parent, data, key) {
    var items = data[key];
    var ids = [];
    for (var key in items) {
      ids.push(key);
    }
    return ids;
  },

  extractEmbeddedHasMany: function(loader, relationship, array, parent, prematerialized) { 
    var objs = [];

    // find belongsTo key that matches the relationship
    var match;
    Ember.get(relationship.type, "relationshipsByName").forEach(function(name, relation) {
      if (relation.kind == "belongsTo" && relation.type == relationship.parentType)
        match = name;
    });

    // turn {id: resource} -> [resource] with id property
    for (var key in array) {
     var obj = Ember.copy(array[key]);
     obj.id = key;
     obj[match] = parent.id;
     objs.push(obj);
    };
    this._super(loader, relationship, objs, parent, prematerialized);
  },

  // slightly modified from json serializer
  addHasMany: function(hash, record, key, relationship) {
    var type = record.constructor;
    var name = relationship.key;
    var manyArray, embeddedType;

    // Get the DS.ManyArray for the relationship off the record
    manyArray = record.get(name);

    embeddedType = this.embeddedType(type, name);

    // if not embedded, just add array of ids
    if (embeddedType !== 'always') { 
      record.getRef().child(key).once("value", function(snapshot) {
        var ids = [];
        snapshot.forEach(function (childSnap) {
          ids.push(childSnap.name());
        });

        manyArray.forEach(function (childRecord) {
          childRecord.getRef(record.get("id"));     // hacky - forces id creation
          if (!ids.contains(childRecord.get("id")))
            record.getRef().child(key).child(childRecord.get("id")).set(true);
        });
      });

      return; 
    }

    // Build up the array of serialized records
    var serializedHasMany = {};
    manyArray.forEach(function (childRecord) {
      childRecord.getRef(record.get("id"));     // hacky - forces id creation
      serializedHasMany[childRecord.get("id")] = childRecord.serialize();
    }, this);

    // Set the appropriate property of the serialized JSON to the
    // array of serialized embedded records
    hash[key] = serializedHasMany;
  },
});

