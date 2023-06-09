const pushdrop = require('pushdrop')
const KnexStorageEngine = require('./KnexStorageEngine')

/**
 * Note: initial implementation uses basic Javascript class implementation and not abstract classes.
 * TODO: Create an interface using Typescript that describes the requirements of a LookupService,
 * then implement it specifically for KVStore
 * StorageEngine should also use an interface and specifically implement it for KVStore
 */

/**KVStore Protocol fields
0=<pubkey>
1=OP_CHECKSIG
2=protected key
3=value
4=A signature from the field 0 public key over fields 2-3
Above 9=OP_DROP / OP_2DROP — Drop fields 2-4 from the stack.**/


class KVStoreLookupService {
  constructor ({ storageEngine, topics = ['kvstore'] }) {
    this.storageEngine = storageEngine
    this.topics = topics
  }

  /**
   * Notifies the lookup service of a new output added.
   * @param {Object} obj all params are given in an object
   * @param {string} obj.txid the transactionId of the transaction this UTXO is apart of
   * @param {Number} obj.vout index of the output
   * @param {Buffer} obj.outputScript the outputScript data for the given UTXO
   * @returns {string} indicating the success status
   */
  async outputAdded ({ txid, vout, outputScript, topic }) {
    if (!this.topics.includes(topic)) return
    // Decode the KVStore fields from the Bitcoin outputScript
    const result = pushdrop.decode({
      script: outputScript.toHex(),
      fieldFormat: 'buffer'
    })

    // TSP song data to store
    const protectedKey = result.fields[0].toString('base64')

    // Store TSP fields in the StorageEngine
    await this.storageEngine.storeRecord({
      txid,
      vout,
      protectedKey
    })
  }

  /**
   * Deletes the output record once the UTXO has been spent
   * @param {ob} obj all params given inside an object
   * @param {string} obj.txid the transactionId the transaction the UTXO is apart of
   * @param {Number} obj.vout the index of the given UTXO
   * @param {string} obj.topic the topic this UTXO is apart of
   * @returns
   */
  async outputSpent ({ txid, vout, topic }) {
    if (!this.topics.includes(topic)) return
    await this.storageEngine.deleteRecord({ txid, vout })
  }

  /**
   *
   * @param {object} obj all params given in an object
   * @param {object} obj.query lookup query given as an object
   * @returns {object} with the data given in an object
   */
  async lookup ({ query }) {
    // Validate Query
    if (!query) {
      const e = new Error('Lookup must include a valid query!')
      e.code = 'ERR_INVALID_QUERY'
      throw e
    }
    if (query.protectedKey) {
      return await this.storageEngine.findByProtectedKey({
        protectedKey: query.protectedKey
      })
    } else {
      const e = new Error('Query parameters must include a valid Identity Key, Title, Artist Name, Song ID, or Display all!')
      e.code = 'ERR_INSUFFICIENT_QUERY_PARAMS'
      throw e
    }
  }
}
KVStoreLookupService.KnexStorageEngine = KnexStorageEngine
module.exports = KVStoreLookupService