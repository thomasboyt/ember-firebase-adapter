var Person = DS.Firebase.Model.extend({
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
    start();
  }.bind(this));
});

asyncTest("Finding all records in a resource", function() {
  expect(2);

  this.populate();

  var people = Person.find();

  people.addObserver("length", function() {
    if (people.get("length") === 2) {
      equal(people.objectAt(0).get("id"), this.yehudaId, "Records are loaded in order of their keys");
      equal(people.objectAt(1).get("firstName"), "Tom", "All records are properly loaded");
      start();
    }
  }.bind(this));
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
      if (snap.name() === this.yehudaId) {
        ok(true, "Deleting a record removes it from Firebase");
        start();
      }
    }.bind(this));
  }.bind(this));
});


