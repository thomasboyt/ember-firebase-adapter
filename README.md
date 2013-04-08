## What? 

This is a [Firebase](https://www.firebase.com/) adapter for [Ember Data](https://github.com/emberjs/data).

## Why?

Firebase is powerful because it sort of works as a standard CRUD store, with the unique twist of being able to live update models and collections.

Honestly, it's a bit weird mixing standard Ember Data CRUD operations with real-time updates, but it seems to be working out so far, and only feels *slightly* hacky. 

This adapter can be used as a normal CRUD adapter, or to automatically add or remove models and properties as they are changed on your Firebase backend. This makes it shockingly powerful for combining persistence and live updates.

## Getting Started

First, create an Ember Data store with a Firebase adapter:

```javascript
App.store = DS.Store.create({
  revision: 12,
  adapter: DS.Firebase.Adapter.create({
    dbName: "your-db-name-here"
  })
});
```

Next, create models that extend `DS.Firebase.Model` or `DS.Firebase.LiveModel`. This is *required* for the store to work!

### Static and Live Models

"Static" models are models that subclass `DS.Firebase.Model`. These models do not respond to server-side changes - that is, they act like any other Ember Data store, where you have to specifically query (via `find`) for changes.

"Live" models are models that subclass `DS.Firebase.LiveModel`. These models are particularly powerful, as their properties will change as the server-side representation of them does. This makes it incredibly easy to create real-time applications without writing boilerplate code to listen for changes.

Note that only properties that are specified when defining a model will be listened for, meaning that you can't simply add arbitrary properties on the server-side. For example if you have the following:

```javascript

App.Person = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),
  twitter: DS.attr('string')
});

var wycats = App.Person.createRecord({
  firstName: "Yehuda",
  lastName: "Katz"
});

App.store.commit();
```

If you were to then add a "twitter" property to this resource on Firebase, it would show up on the model. On the other hand, if you tried to add a "github" property to the resource, it wouldn't show up on the model, as it wasn't defined.

### Live Collections

For live collections - that is, an array of your models at a particular resource that will automatically add and delete models based on changes in your Firebase resource - you'll want to use `YourModel.find()` (which creates a `findAll` request in the adapter). Live collections work for both static and live models.

Live collections are only supported when they're "bound" to an entire resource - that is, doing a find with any kind of query (including a blank one) will create a static collection. 

### Relationships

Firebase, being a hierarchial data store, is built around *embedded* relationships: querying a resource will include children. When you retrieve any kind of resource from Firebase that has child resources, you'll get those in the JSON payload. In Ember Data, these sorts of resources are called *embedded relationships.* You need to use a little bit of extra boilerplate to enable an embedded relationship.

Let's say you had a simple scheme, where a *Post* resource has *Comments* stored under it. This would translate into these Ember models:

```javascript
App.Post = DS.Model.create({
  title: DS.attr("string"),
  content: DS.attr("string"),

  comments: DS.hasMany("App.Comment", {embedded: 'always'}),
});

App.Comment = DS.Model.create({
  author: DS.attr("string"),
  content: DS.attr("string"),

  post: DS.belongsTo("App.Post")
});
```

Here, if comments are *embedded* within in post resources - i.e., represented by `http://myfirebase.firebaseio.com/posts/<post id>/comments/<comment id>` - then when a post is fetched, its comments will be fetched with it, as long as you enable it on the adapter like this:

```javascript

var MyAdapter = DS.Firebase.Adapter;
MyAdapter.map("App.Post", {
  comments: {embedded: 'always'}
});
```

Now, when you load a post, its comments will be loaded with it. Note that when you add or update a comment on a post, when you commit, Ember will actually save the *Post* resource back to the server. 

But what if you want *relational* relationships? In these relationships,  If you don't specify `embedded`, then the relation will work like a standard relational REST resource - if the post resource had a `comments` attribute that contained an array of post ids, the adapter will look for them within `http://myfirebase.firebaseio.com/comments/<comment id>`. These work pretty much like you'd expect, but remember that they're not really what Firebase was built for - don't rely on them too much!

#### Live Relationships

These are partially-implemented, but be warned there are no tests for them, and they *heavily* abuse how Ember Data works. Expect oddities.

### Other Tips

You can access the Firebase object with `App.store.adapter.fb`, if you want to add your own hooks (for example, to [handle presence](https://www.firebase.com/docs/managing-presence.html) or [check authentication](https://www.firebase.com/docs/security-quickstart.html).

## Todo

There's [a lot of work left to do](https://github.com/thomasboyt/ember-firebase-adapter/issues?state=open). Much of it is waiting for changes in Ember Data. For example, in Ember Data, there is essentially no (documented) way to return a "404/not found" on a find query, so that has yet to be implemented in this adapter, as well as a lot of other error handling.

Remember, since the Firebase object is exposed by the adapter, if you find yourself faced with an edge case that the adapter can't handle, you may be able to do it manually!

## Tests

Create a Firebase DB for testing, then create a `tests/firebase_db.js` file like so:

```javascript
window.DB_NAME = "your_db_subdomain_here";
```

Throw up a static server in the root directory of this repo, and navigate your browser to `test/` to run tests.
