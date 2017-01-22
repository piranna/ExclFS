const fs   = require('fs')
const join = require('path').join

const context = require('fuse-bindings').context
const filter  = require('async').filter


function ExclFS(lowerLayer, options)
{
  if(!(this instanceof ExclFS)) return new ExclFS(lowerLayer, options)

  const ownerPerm = options.ownerPerm
  const whitelist = (options.whitelist || []).map(RegExp)

  const SHOW_OWNER_MASK = ownerPerm ? 0707 : 0077


  /**
   * Get path on the underlaying filesystem in an unique way
   */
  function getFilePath(path, callback)
  {
    fs.realpath(join(lowerLayer, path), callback)
  }


  const filesInUse = {}


  this.getattr = function(path, callback)
  {
    getFilePath(path, function(error, path)
    {
      if(error) return callback(error)

      fs.stat(path, function(error, stats)
      {
        if(error) return callback(error)

        const ctx = context()

        const mode = stats.mode
        stats.mode = mode & ~0770

        if(ownerPerm || stats.uid === ctx.uid)
          stats.mode |= mode & 0700
        else
          stats.mode |= (mode & 0070) << 3

        const file = filesInUse[path]
        if(file)
        {
          stats.uid = file.uid
          stats.gid = file.gid
        }
        else
        {
          // [ToDo] confirm that we can't use `-1` (unknown) ofr uid & gid
          stats.uid = ctx.uid
          stats.gid = ctx.gid
        }

        callback(null, stats)
      })
    })
  }


  // Directories

  function showEntry(path, uid, entry, callback)
  {
    path = join(path, entry)

    getFilePath(path, function(error, filepath)
    {
      if(error)
      {
        if(error.code === 'ENOENT') return callback(null, false)

        return callback(error)
      }

      const file = filesInUse[filepath]
      if(!file)
      {
        // File not being used/owned, check if it's whitelisted
        for(var entry in whitelist)
          if(entry.test(path))
            return callback(null, true)
      }

      // Check if we are using the file ("owned" by us)
      else if(file.uid === uid) return callback(null, true)

      // Other users or not whitelisted
      fs.stat(filepath, function(error, stats)
      {
        if(error) return callback(error)

        // Real file is owned by us, or use 'owner' & 'others' file permissions
        callback(null, stats.uid === uid
                    || stats.mode & (file ? 0007 : SHOW_OWNER_MASK))
      })
    })
  }

  this.readdir = function(path, callback)
  {
    fs.readdir(join(lowerLayer, path), function(error, files)
    {
      if(error) return callback(error)

      filter(files, showEntry.bind(undefined, path, context().uid), callback)
    })
  }


  // Symlinks

  this.readlink = getFilePath


  // Files

  this.open = function(path, flags, callback)
  {
    getFilePath(path, function(error, path)
    {
      if(error) return callback(error)

      fs.open(path, flags, function(error, fd)
      {
        if(error) return callback(error)

        const file = filesInUse[path]
        if(!file)
        {
          var ctx = context()

          filesInUse[path] = file =
          {
            counter: 0,
            uid: ctx.uid,
            gid: ctx.gid
          }
        }

        file.counter++

        callback(null, fd)
      })
    })
  }
  this.release = function(path, fd, callback)
  {
    getFilePath(path, function(error, path)
    {
      if(error) return callback(error)

      fs.close(fd, function(error)
      {
        if(error) return callback(error)

        if(!--filesInUse[path].counter)
          delete filesInUse[path]

        callback()
      })
    })
  }

  // [ToDO] Move to server.js when we are ready for nan2
  this.options = ['allow_other', 'dev', 'nonempty']
}


// Files

ExclFS.prototype.read = function(path, fd, buffer, length, position, callback)
{
  fs.read(fd, buffer, 0, length, position, callback)
}
ExclFS.prototype.write = function(path, fd, buffer, length, position, callback)
{
  fs.write(fd, buffer, position, callback)
}


module.exports = ExclFS
