import { Serializer } from 'firebase/serializer';

export var Adapter = DS.Adapter.extend({
  serializer: Serializer.create(),

  localLock: false,
  _listenRefs: [],

  fb: undefined,

  init: function() {
    if (!this.dbName && !this.url) {
      throw new Error("You must specify a dbName representing the subdomain of your Firebase.");
    }

    if (!this.url) this.url = "https://" + this.dbName + ".firebaseio.com";
    this.fb = new Firebase(this.url);

    this._super();
  },

  createRecords: function(store, type, records) {
    records.forEach(function(record) {
      var ref = record.getRef();
      var data = record.serialize();

      // goofy. causes child_added callback on findAll to ignore local additions, 
      // preventing duplicate items
      this.localLock = true;
      ref.update(data);
      this.localLock = false;
    }.bind(this));
    store.didSaveRecords(records);
  },

  updateRecords: function(store, type, records) {
    records.forEach(function(record) {
      var ref = record.getRef();
      var data = record.serialize();
      
      ref.update(data);
    }.bind(this));
    store.didSaveRecords(records);
  },

  deleteRecords: function(store, type, records) {
    records.forEach(function(record) {
      var ref = record.getRef();
      this.localLock = true;
      ref.remove();
      this.localLock = false;
    }.bind(this));
    store.didSaveRecords(records);
  },

  find: function(store, type, id) {
    var ref = this._getRefForType(type).child(id);
    ref.once("value", function(snapshot) {
      // TODO: ew, silent failure.
      var data = Ember.copy(snapshot.val()) || {};
      data.id = id;
      
      this.didFindRecord(store, type, data, id);
    }.bind(this));
  },

  _makeLive: function(ref, store, type) {
    this._listenRefs.push(ref);
    ref.on("child_added", function(child) {
      if (!this.localLock) {
        var data = child.val()
        data.id = child.name();
        this.didFindMany(store, type, [data]);
      }
    }.bind(this));

    ref.on("child_removed", function(child) {
      if (!this.localLock) {
        var id = child.name();
        var rec = store.findById(type, id);
        if (rec) {
          rec.deleteRecord();
        }
      }
    }.bind(this));
  },

  findAll: function(store, type) {
    var ref = this._getRefForType(type);
    
    ref.once("value", function(snapshot) {
      var results = [];
      snapshot.forEach(function(child) {
        var data = child.val();
        data.id = child.name();
        results.push(Ember.copy(data));
      }.bind(this));
      
      this.didFindAll(store, type, results);

      this._makeLive(ref, store, type);

    }.bind(this));
  },

  findQuery: function(store, type, query, recordArray) {
    var ref = this._getRefForType(type);

    if (query.limit) {
      ref = ref.limit(query.limit);
    }

    ref.once("value", function(snapshot) {
      var results = [];
      snapshot.forEach(function(child) {
        var data = child.val();
        data.id = child.name();
        results.push(Ember.copy(data));
      }.bind(this));
      
      this.didFindQuery(store, type, results, recordArray);
      
      if (query.live !== false) {
        this._makeLive(ref, store, type);
      }

    }.bind(this));
  },

  // some day this might do some sort of deeper find
  _getRefForType: function(type) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));

    return this.fb.child(name);
  },

  destroy: function() {
    this._listenRefs.forEach(function(ref) {
      ref.off("child_added");
      ref.off("child_changed");
      ref.off("child_removed");
    });
    this._listenRefs.clear();

    this._super();
  }

});


