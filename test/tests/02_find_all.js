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
          start();
        }
      });

      this.yehudaRef.remove();
    }
  }.bind(this));
});


