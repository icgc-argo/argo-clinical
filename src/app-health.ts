export type AppHealth = {
  all: ComponentStatus;
  db: ComponentStatus;
  schema: ComponentStatus;
  egoPublicKey: ComponentStatus;
  rxNormDb: ComponentStatus;
};

// source: https://unicode.org/Public/emoji/12.0/emoji-test.txt
export enum Status {
  OK = '😇',
  UNKNOWN = '🤔',
  ERROR = '😱',
}

export type ComponentStatus = {
  status: Status;
  statusText?: 'OK' | 'N/A' | 'ERROR';
  info?: any;
};

const health: AppHealth = {
  all: {
    status: Status.UNKNOWN,
    statusText: 'N/A',
  },
  db: {
    status: Status.UNKNOWN,
    statusText: 'N/A',
  },
  schema: {
    status: Status.UNKNOWN,
    statusText: 'N/A',
  },
  egoPublicKey: {
    status: Status.UNKNOWN,
    statusText: 'N/A',
  },
  rxNormDb: {
    status: Status.UNKNOWN,
    statusText: 'N/A',
  },
};

export function setStatus(component: keyof AppHealth, status: ComponentStatus) {
  if (status.status == Status.OK) {
    status.statusText = 'OK';
  }
  if (status.status == Status.UNKNOWN) {
    status.statusText = 'N/A';
  }
  if (status.status == Status.ERROR) {
    status.statusText = 'ERROR';
  }
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
