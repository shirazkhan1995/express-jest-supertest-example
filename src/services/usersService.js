const { validateNewUser, parseId, parsePagination } = require("../domain/validate");
const { NotFoundError, ConflictError } = require("../domain/errors");

function createUsersService({ usersRepo }) {
  return {
    async createUser(body) {
      const data = validateNewUser(body);
      if (usersRepo.findByEmail(data.email)) {
        throw new ConflictError(`A user with email ${data.email} already exists`);
      }
      return usersRepo.create(data);
    },

    async getUser(idRaw) {
      const id = parseId(idRaw, "userId");
      const user = usersRepo.findById(id);
      if (!user) throw new NotFoundError("User", id);
      return user;
    },

    async listUsers(query) {
      const { page, pageSize, limit, offset } = parsePagination(query);
      return {
        items: usersRepo.list({ limit, offset }),
        page,
        pageSize,
        total: usersRepo.count(),
      };
    },

    async deleteUser(idRaw) {
      const id = parseId(idRaw, "userId");
      if (!usersRepo.remove(id)) throw new NotFoundError("User", id);
    },
  };
}

module.exports = { createUsersService };
