//@flow
export type Symbol = string;

export type TokenImage = {
  meta: string,
  url: string
};

export type Token = {
  address: string,
  symbol: Symbol,
  decimals: number,
  image: TokenImage
};

export type TokenBalance = {
  symbol: Symbol,
  balance: number,
  allowance?: string
};

export type Tokens = Array<Token>;
export type TokenBalances = Array<TokenBalance>;

export type RankedToken = {
  address: string,
  symbol: string,
  decimals: number,
  rank: number
};

export type TokenPair = {
  +pair: string,
  +baseTokenSymbol: string,
  +quoteTokenSymbol: string,
  +baseTokenAddress: string,
  +baseTokenDecimals: number,
  +quoteTokenDecimals: number,
  +quoteTokenAddress: string,
  +makeFee: string,
  +takeFee: string,
  +listed: bool,
  +active: bool,
  +rank: number,
};

export type TokenPairs = Array<TokenPair>;

export type TokenData = {
  address: string,
  symbol: Symbol,
  balance: string,
  allowance: string,
  allowed: boolean,
  allowancePending?: boolean,
  image: TokenImage
};

export type TokenPairData = {
  pair: string,
  lastPrice: string,
  change: string,
  high: string,
  open: string,
  low: string,
  volume: string,
  base: ?string,
  quote: ?string,
  favorited: ?string,
  orderCount: string,
  orderVolume: string,
};

export type TokenPairDataArray = Array<TokenPairData>;
export type TokenPairDataMap = { [string]: TokenPairData };

export type TokenState = {
  +symbols: Array<Symbol>,
  +bySymbol: {
    [Symbol]: Token
  },
  +data: {
    +[string]: {
      +pair: string,
      +lastPrice: string,
      +change: string,
      +high: string,
      +low: string,
      +volume: string
    }
  },
  +favorites: Array<string>,
  +currentPair: string
};

export type TokenPairState = {
  +byPair: {
    +[string]: TokenPair
  },
  +data: Array<TokenPairData>,
  +favorites: Array<string>,
  +currentPair: string,
  +sortedPairs: Array<string>,
};

export type TokenEvent = any => TokenState => TokenState;
export type TokenPairEvent = any => TokenPairState => TokenPairState;
