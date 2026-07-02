const { Router } = require("express");

function createUsersRouter({ usersService }) {
  const router = new Router();

  router.post("/", async (req, res) => {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  });

  router.get("/", async (req, res) => {
    res.json(await usersService.listUsers(req.query));
  });

  router.get("/:id", async (req, res) => {
    res.json(await usersService.getUser(req.params.id));
  });

  router.delete("/:id", async (req, res) => {
    await usersService.deleteUser(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createUsersRouter };
