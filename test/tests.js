QUnit.config.autostart = false;
QUnit.config.reorder = false;

var fb = new Firebase("https://" + window.DB_NAME + ".firebaseio.com")

var Person = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),
  twitter: DS.attr('string'),
  github: DS.attr('string')
});

Person.toString = function() {
  return "App.Person";
};

module('CRUD Operations', {
  setup: function() {
    // reset firebase
    stop();
    fb.remove(function(error) {
      this.adapter = DS.Firebase.Adapter.create({
        dbName: window.DB_NAME
      });

      this.store = DS.Store.create({
        adapter: this.adapter,
        revision: 12
      });

      start();
    }.bind(this));
  },

  populate: function() {
    this.yehudaId = fb.child("persons").push({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats"
    }).name();
    fb.child("persons").push({
      firstName: "Tom",
      lastName: "Dale",
      twitter: "tomdale"
    });
  },

  teardown: function() {
    stop();

    this.adapter.fb.child("persons").off();

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Creating records", function() {
  expect(1);

  var fix = {
    firstName: "Yehuda",
    lastName: "Katz",
    twitter: "wycats"
  };
  
  var newPerson = Person.createRecord(fix);
  this.store.commit();

  fb.child("persons").child(newPerson.get("id")).once("value", function(snap) {
    deepEqual(snap.val(), fix, "Creating a record initializes a new Firebase record with correctly-set properties.");
    newPerson.disableBindings();
    start();
  });
});

asyncTest("Finding records by id", function() {
  expect(2);

  this.populate();

  var person = Person.find(this.yehudaId);
  person.on("didLoad", function() {
    equal(person.get("firstName"), "Yehuda", "Finding a record populates it with correct properties");
    equal(person.get("id"), this.yehudaId, "Finding a record populates it with the correct ID");
    person.disableBindings();
    start();
  }.bind(this));
});

asyncTest("Finding all records in a resource", function() {
  expect(2);

  this.populate();

  var people = Person.find();

  people.addObserver("length", function() {
    if (people.get("length") == 2) {
      equal(people.objectAt(0).get("id"), this.yehudaId, "Records are loaded in order of their keys");
      equal(people.objectAt(1).get("firstName"), "Tom", "All records are properly loaded");
      people.forEach(function(person) {person.disableBindings()});
      start();
    }
  }.bind(this))
});

asyncTest("Updating records", function() {
  expect(1);

  this.populate();

  var yehuda = Person.find(this.yehudaId);

  yehuda.on("didLoad", function() {
    yehuda.set("github", "wycats");

    yehuda.on("didUpdate", function() {
      fb.child("persons").child(this.yehudaId).once("value", function(snap) {
        equal(snap.val().github, "wycats", "Updating a model's property updates the back-end resource");
        yehuda.disableBindings();
        start();
      });
    }.bind(this));

    this.store.commit();
  }.bind(this));
});

asyncTest("Deleting records", function() {
  expect(1);

  this.populate();

  var yehuda = Person.find(this.yehudaId);

  yehuda.on("didLoad", function() {
    yehuda.deleteRecord();
    this.store.commit();

    // TODO: for some reason, on(child_removed) is triggering for prior
    // deletion from teardown before yehudaId.
    var ignoredFirst = false;
    fb.child("persons").on("child_removed", function(snap) {
      if (!ignoredFirst) {
        ignoredFirst = true;
        return;
      }
      equal(snap.name(), this.yehudaId, "Deleting a record removes it from Firebase");
      start();
    }.bind(this));
  }.bind(this));
});

module("Find all/live arrays", {
  setup: function() {
    stop();

    fb.remove(function() {
      this.adapter = DS.Firebase.Adapter.create({
        dbName: window.DB_NAME
      });

      this.store = DS.Store.create({
        adapter: this.adapter,
        revision: 12
      });

      start();
    }.bind(this));
  },

  populate: function() {
    this.yehudaRef = fb.child("persons").push({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats"
    });
    fb.child("persons").push({
      firstName: "Tom",
      lastName: "Dale",
      twitter: "tomdale"
    });
    fb.child("persons").push({
      firstName: "Ryan",
      lastName: "Florence",
      twitter: "ryanflorence"
    });
  },

  teardown: function() {
    stop();
    this.adapter.fb.child("persons").off();

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Creating new item", function() {
  expect(1)
  this.populate();

  var people = Person.find();

  people.addObserver("length", function() {
    if (people.get("length") == 3) {
      fb.child("persons").push({
        firstName: "Peter",
        lastName: "Wagenet",
        twitter: "wagenet"
      });
    }
    if (people.get("length") == 4) {
      equal(people.objectAt(3).get("firstName"), "Peter", "Adding a new person resource adds it to the findAll result");
      people.forEach(function(person) {person.disableBindings()});
      start();
    }
  }.bind(this))
});

asyncTest("Removing item", function() {
  expect(1);
  this.populate();

  var people = Person.find();

  people.addObserver("length", function() {
    if (people.get("length") == 3) {
      people.removeObserver("length");

      people.addObserver("length", function() {
        if (people.get("length") == 2) {
          people.removeObserver("length");
          ok(people.objectAt(0).get("firstName"), "Tom", "Removing a resource on the server removes it from the findAll array");
          people.forEach(function(person) {person.disableBindings()});
          start();
        }
      });

      this.yehudaRef.remove();
    }
  }.bind(this));
});

module('Live property updates', {
  setup: function() {
    stop();

    fb.remove(function() {
      this.adapter = DS.Firebase.Adapter.create({
        dbName: window.DB_NAME
      });

      this.store = DS.Store.create({
        adapter: this.adapter,
        revision: 12
      });

      start();
    }.bind(this));
  },

  populate: function() {
    this.yehuda = Person.createRecord({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats",
    });

    this.store.commit();
  },

  teardown: function() {
    stop();
    this.adapter.fb.child("persons").off();
    this.yehuda = null;

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Properties can be added on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("github"), "wycats", "A property added on Firebase will be added to the model");
    this.disableBindings();
    start();
  });

  fb.child("persons").child(this.yehuda.get("id")).child("github").set("wycats");
});

asyncTest("Properties can be updated on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), "yehuda_katz", "A property changed on Firebase will be changed on the model");
    this.disableBindings();
    start();
  });

  // make sure model has synced back to the server before setting a direct property.
  setTimeout(function() {
    fb.child("persons").child(this.yehuda.get("id")).child("twitter").set("yehuda_katz");
  }.bind(this), 250);
});

asyncTest("Properties can be removed on the back-end", function() {
  expect(1)

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), null, "A property removed on Firebase will be removed on the model");
    this.disableBindings();
    start();
  });

  setTimeout(function() {
    fb.child("persons").child(this.yehuda.get("id")).child("twitter").remove();
  }.bind(this), 250);
});

// ===================================
// Relationships
// ===================================

var User = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),

  screenNames: DS.hasMany('ScreenName')
});
User.toString = function() {
  return "App.User";
};

var ScreenName = DS.Firebase.LiveModel.extend({
  name: DS.attr('string'),

  user: DS.belongsTo('User')
});
ScreenName.toString = function() {
  return "App.ScreenName";
};
  
module('Embedded relationships', {
  setup: function() {
    stop();

    fb.remove(function() {
      var Adapter = DS.Firebase.Adapter;
      Adapter.map(User, {
        screenNames: {embedded: 'always'}
      });

      this.adapter = Adapter.create({
        dbName: window.DB_NAME
      });

      this.store = DS.Store.create({
        adapter: this.adapter,
        revision: 12
      });

      start();
    }.bind(this));
  },
  populate: function() {
    this.id = fb.child("users").push({
      firstName: "Thomas",
      lastName: "Boyt",
      screenNames: {
        github: {name: "thomasboyt"},
        twitter: {name: "thomasaboyt"},
        website: {name: "http://thomasboyt.com"}
      }
    }).name();
  },
  teardown: function() {
    stop();

    this.adapter.fb.child("users").off();

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Embedded hasMany is loaded when its parent is read", function() {
  expect(2);

  this.populate();

  var user = User.find(this.id);

  user.one("didLoad", function() {
    equal(this._data.hasMany.screenNames.length, 3, "Loading a record loads its embedded relationships");
    equal(this.get("screenNames").findProperty("id", "github").get("name"), "thomasboyt", "Loading a relationship's record loads its key as its ID & loads its properties");
    start();
  });
});

asyncTest("When an embedded model is created, its parent is updated", function() {
  expect(2);

  this.populate();

  var user = User.find(this.id);

  user.one("didLoad", function() {
    var newScreenName = ScreenName.createRecord({
      name: "me@thomasboyt.com",
      id: "email",
      user: user
    });

    user.one("didUpdate", function() {
      console.log("didUpdate");
      fb.child("users").child(this.id).child("screenNames").child("email").on("value", function(snap) {
        equal(snap.val().name, "me@thomasboyt.com", "Creating an embedded model creates a new Firebase resource");
        equal(snap.val().user, this.id, "Creating an embedded model with a belongsTo sets a parent id property");
        start();
      }.bind(this));
    }.bind(this));

    this.store.commit();
  }.bind(this));
});

asyncTest("When an embedded model is updated, its parent is updated", function() {});
asyncTest("When an embedded model is deleted, its parent is updated", function() {});

/*module("Embedded live associations", {
  setup: function() {
  },
  teardown: function() {
  }
});

module('Relational associations', {
  setup: function() {
  },
  teardown: function() {
  }
});*/

QUnit.start();
