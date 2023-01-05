import Entities from "./entities";
const SnakeNamingStrategy = require("typeorm-naming-strategies").SnakeNamingStrategy;

export const typeOrmOptions = {
  host: "127.0.0.1",
  port: 3306,
  username: "illiquidly",
  password: "illiquidly",
  database: "ILLIQUIDLY",
  entities: Entities,
  autoLoadEntities: true,
  synchronize: true,
  //logging: true,
  namingStrategy: new SnakeNamingStrategy(),
};
