export type AppHealth = {
  all: ComponentStatus;
  db: ComponentStatus;
  schema: ComponentStatus;
  egoPublicKey: ComponentStatus;
};

// source: https://unicode.org/Public/emoji/12.0/emoji-test.txt
export enum Status {
  OK = '😇',
  UNKNOWN = '🤔',
  ERROR = '😱',
}
export type ComponentStatus = {
  status: Status;
  info?: any;
};

const health: AppHealth = {
  all: {
    status: Status.UNKNOWN,
  },
  db: {
    status: Status.UNKNOWN,
  },
  schema: {
    status: Status.UNKNOWN,
  },
  egoPublicKey: {
    status: Status.UNKNOWN,
  },
};

export function setStatus(component: keyof AppHealth, status: ComponentStatus) {
  health[component] = status;
  for (const k in health) {
    const key = k as keyof AppHealth;
    if (key == 'all') {
      continue;
    }
    if (health[key].status !== Status.OK) {
      health['all'].status = Status.ERROR;
      return;
    }
  }
  health['all'].status = Status.OK;
}

export function getHealth(): AppHealth {
  return health;
}
