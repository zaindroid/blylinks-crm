const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { listPublicUsers } = require('../db/usersRepo');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const users = await listPublicUsers();
  res.json(users);
}));

module.exports = router;
